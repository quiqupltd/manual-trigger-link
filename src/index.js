import { ApolloLink, Observable } from 'apollo-link'

/**
 * A link to trigger data reception manually. E.g. to simulate subscription events.
 * You can't trigger induvidual operation without name.
 *
 * `setTriggers` function receives an object with available triggers.
 */
export default class ManualTriggerLink extends ApolloLink {
  constructor({ setTriggers }) {
    super()
    this.calls = {}
    this.setTriggersExternal = setTriggers
  }

  /**
   * Runs operations for calls by specified operation name,
   * or all operations, if operation name is not passed.
   */
  trigger = (nameToTrigger = null, mockingParams) => {
    Object.keys(this.calls).forEach(key => {
      const { operation, forward, observers } = this.calls[key]
      if (!nameToTrigger || operation.operationName === nameToTrigger) {
        operation.setContext({ mockingParams })
        this.run(operation, forward, observers)
      }
    })
  }

  inspect = () => {
    const inspection = Object.values(this.calls)
    inspection.originalCalls = this.calls
    return inspection
  }

  /**
   * Calls `setTriggers` passed via link options with an updated `triggers` object.
   * `triggers` object will contain `_all` and `_inspect` functions, and calls to `this.trigger` by operation name
   * (so all named operations can be triggered separatly).
   */
  updateTriggers = () => {
    const names = getNames(this.calls)
    const triggers = {
      _all: mockingParams => this.trigger(null, mockingParams),
      _inspect: this.inspect,
    }
    names.forEach(name => {
      triggers[name] = mockingParams => this.trigger(name, mockingParams)
    })
    this.setTriggersExternal(triggers)
  }

  /**
   * Runs an operation and passes the result for all registered observers.
   */
  run = (operation, forward, observers) => {
    const subscription = forward(operation).subscribe({
      next: result => {
        subscription.unsubscribe()
        observers.forEach(obs => obs.next(result))
      },
      error: error => {
        subscription.unsubscribe()
        observers.forEach(obs => obs.error(error))
      },
    })
  }

  /**
   * Drops observers, subscriptions for which are closed.
   */
  reconcileObservers = () => {
    const deletable = Object.keys(this.calls).reduce((acc, key) => {
      this.calls[key].observers = this.calls[key].observers.filter(obs => !obs.closed)
      if (!this.calls[key].observers.length) {
        acc.push(key)
      }
      return acc
    }, [])
    deletable.forEach(key => delete this.calls[key])
  }

  /**
   * Link entry point. Registers a call and returns an observable, which can be resolved when a corresponding
   * trigger is called.
   */
  request = (operation, forward) => {
    this.reconcileObservers()
    return new Observable(observer => {
      const key = operation.toKey()
      if (this.calls[key]) {
        this.calls[key].observers.push(observer)
      } else {
        this.calls[key] = {
          operation,
          forward,
          observers: [observer],
        }
        this.updateTriggers()
      }
    })
  }
}

/**
 * Returns an array of operation names by the array of calls to the link.
 */
function getNames(calls) {
  return Object.keys(calls).reduce((acc, key) => {
    const {
      operation: { operationName: name },
    } = calls[key]
    if (name) {
      acc.push(name)
    }
    return acc
  }, [])
}
