import ApolloClient from 'apollo-client'
import { InMemoryCache } from 'apollo-cache-inmemory'
import gql from 'graphql-tag'
import { ApolloLink, Observable } from 'apollo-link'
import ManualTriggerLink from './index'

function noop() {}

const SUB = gql`
  subscription newEvent {
    newEvent {
      id
    }
  }
`
const SUB2 = gql`
  subscription updateEvent {
    updateEvent {
      id
    }
  }
`

const endLinkFuncFactory = (options = {}) =>
  jest.fn(operation => {
    return new Observable(observer => {
      if (options.error) {
        observer.error({
          error: 'Some error message',
        })
      } else {
        observer.next({
          data:
            operation.operationName === 'newEvent'
              ? { newEvent: { id: 123, __typename: 'NewEvent' } }
              : { updateEvent: { id: 123, name: 'Name', __typename: 'UpdateEvent' } },
        })
      }
    })
  })

const createEndLink = options => new ApolloLink(endLinkFuncFactory(options))

describe('ManualTriggerLink', () => {
  it('can create without throwing', () => {
    expect(() => new ManualTriggerLink({ setTriggers: noop })).not.toThrow()
  })
  it('can be used in client without throwing', () => {
    expect(() => {
      const link = new ManualTriggerLink({ setTriggers: noop })
      // eslint-disable-next-line no-new
      new ApolloClient({
        cache: new InMemoryCache(),
        link,
      })
    }).not.toThrow()
  })
  it('registers a request when it comes', () => {
    const link = new ManualTriggerLink({ setTriggers: noop })
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([link, createEndLink()]),
    })
    client.subscribe({ query: SUB }).subscribe({ next: noop })
    expect(link.inspect()).toMatchSnapshot()
  })
  it('reconciles observers list on next request to drop closed observers', () => {
    const link = new ManualTriggerLink({ setTriggers: noop })
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([link, createEndLink()]),
    })
    const sub = client.subscribe({ query: SUB }).subscribe({ next: noop })
    expect(getObservers(link.inspect()).length).toBe(1)
    client.subscribe({ query: SUB2 }).subscribe({ next: noop })
    expect(getObservers(link.inspect()).length).toBe(2)
    sub.unsubscribe()
    client.subscribe({ query: SUB2 }).subscribe({ next: noop })
    expect(getObservers(link.inspect()).length).toBe(2)
  })
  it('updates triggers only when a new key appears', () => {
    const setTriggers = jest.fn()
    const link = new ManualTriggerLink({ setTriggers })
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([link, createEndLink()]),
    })
    const expected1 = expect.objectContaining({
      _all: expect.any(Function),
      _inspect: expect.any(Function),
      newEvent: expect.any(Function),
    })
    const expected2 = expect.objectContaining({
      _all: expect.any(Function),
      _inspect: expect.any(Function),
      newEvent: expect.any(Function),
      updateEvent: expect.any(Function),
    })
    client.subscribe({ query: SUB }).subscribe({ next: noop })
    expect(setTriggers).toHaveBeenCalledTimes(1)
    expect(setTriggers).toHaveBeenLastCalledWith(expected1)
    client.subscribe({ query: SUB }).subscribe({ next: noop })
    expect(setTriggers).toHaveBeenCalledTimes(1)
    expect(setTriggers).toHaveBeenLastCalledWith(expected1)
    client.subscribe({ query: SUB2 }).subscribe({ next: noop })
    expect(setTriggers).toHaveBeenCalledTimes(2)
    expect(setTriggers).toHaveBeenLastCalledWith(expected2)
  })
  it('runs triggers by name', async () => {
    const setTriggers = jest.fn()
    const link = new ManualTriggerLink({ setTriggers })
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([link, createEndLink()]),
    })
    const promise = new Promise(resolve => {
      const subscription = client.subscribe({ query: SUB }).subscribe({
        next: ({ data }) => {
          subscription.unsubscribe()
          resolve(data)
        },
      })
    })
    const triggers = setTriggers.mock.calls[0][0]
    triggers.newEvent()
    const data = await promise
    expect(data).toEqual({ newEvent: { id: 123, __typename: 'NewEvent' } })
  })
  it('runs all triggers with _all method', done => {
    const setTriggers = jest.fn()
    const link = new ManualTriggerLink({ setTriggers })
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([link, createEndLink()]),
    })
    const promise1 = new Promise(resolve => {
      const subscription = client.subscribe({ query: SUB }).subscribe({
        next: ({ data }) => {
          subscription.unsubscribe()
          resolve(data)
        },
      })
    })
    const promise2 = new Promise(resolve => {
      const subscription = client.subscribe({ query: SUB2 }).subscribe({
        next: ({ data }) => {
          subscription.unsubscribe()
          resolve(data)
        },
      })
    })
    const triggers = setTriggers.mock.calls[0][0]
    triggers._all() // eslint-disable-line
    Promise.all([promise1, promise2]).then(([data1, data2]) => {
      expect(data1).toEqual({ newEvent: { id: 123, __typename: 'NewEvent' } })
      expect(data2).toEqual({ updateEvent: { id: 123, name: 'Name', __typename: 'UpdateEvent' } })
      done()
    })
  })
  it('passes errors', async () => {
    const setTriggers = jest.fn()
    const link = new ManualTriggerLink({ setTriggers })
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.from([link, createEndLink({ error: true })]),
    })
    const promise = new Promise(resolve => {
      const subscription = client.subscribe({ query: SUB2 }).subscribe({
        error: ({ error }) => {
          subscription.unsubscribe()
          resolve(error)
        },
      })
    })
    const triggers = setTriggers.mock.calls[0][0]
    triggers.updateEvent()
    const error = await promise
    expect(error).toEqual('Some error message')
  })
})

function getObservers(calls) {
  return calls.reduce((acc, call) => [...acc, ...call.observers], [])
}
