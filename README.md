# Manual Trigger Link for Apollo GraphQL Client

An ApolloLink to trigger data coming manually.

## Why?

To have a simulation of GraphQL Subscription events in client-side mocks, runnable from your browser console.

## Installation

```bash
yarn add @quiqup/manual-trigger-link
```

## Peer dependencies

* `apollo-link`

## Usage

**NB!** See also:

* [About Apollo Schema Link](https://www.apollographql.com/docs/link/links/schema.html)
* [About GraphQL Mocking](https://www.apollographql.com/docs/graphql-tools/mocking.html)

#### 1. Use it in your mock client

You it in your mock client and pass a `setTrigger` function.

```js
...
const link = ApolloLink.split(
  hasSubscription,
  ApolloLink.from([new ManualTriggerLink({ setTriggers }), schemaLink]),
  schemaLink
)
const cache = new InMemoryCache()
return new ApolloClient({ cache, link })
```

`setTriggers` function can be called several times during execution and will receive one parameter - an object with the following shape:

```
{
  _all, // Triggers updates on all subscriptions
  _inspect, // Returns an object with all current subscriptions
  [operationName], // A set of functions to trigger updates based on operationName (e.g. `task` for gql`subscription task {...}`)
}
```

Example of `setTriggers` func implementation:

```
const setTriggers = triggers => {
  if (!window.mocks) window.mocks = {}
  window.mocks.triggers = triggers
})
```

#### 2. Setup your mock client

Set up your mock client by setting SchemaLink parameters, like `rootValue` or `mocks`.

Operation triggers can accept a context object which will be passed to your resolvers. In this example we can configure whether we want a normal task or an empty update (say, the task is unassigned from COR):

```
// This root value will be passed to SchemaLink
const rootValue = {
  task: (root, variables, context) => {
    const { empty } = context || {}
    return empty ? null : mockTaskObject
  },
}
```

#### 3. User your mock client in your app

We recommend putting all mocking stuff under a dynamic import and not using it in production.
For example, in dev environment there's a function like that, assigned to a `window` object:

```
mocksOn = async () => {
  const mockClientModule = await import('./get-mock-client')
  const client = await mockClientModule.default(getClientOptions(), triggers => {
    window.mocks.triggers = triggers
  })
}
```

#### 4. Call mocks from dev console

So now you can call your mocks from browser's dev console:

```
mock.triggers.new() // for normal task mock
mock.triggers.new({ empty: true }) // to get an update with `null` as data
```

**NB!** There's an issue with `apollo-link-state`: it doesn't work with subscriptions. Inside, it closes all internal Observers' subscriptions objects, so you can't get new data. That's why for `mock-client` you should have `apollo-link-state` only for normal queries and mutations. This means that for now you **can't use client resolvers for subscriptions**.
Please see this issue: https://github.com/apollographql/apollo-link-state/issues/138

## Acknowledgements

Bootstrapped with [generator-quiqup-lib](https://github.com/quiqupltd/generator-quiqup-lib)

## License

MIT © [![Quiqup](https://avatars3.githubusercontent.com/u/7002399?s=16)Quiqup](https://github.com/QuiqUpLTD)
