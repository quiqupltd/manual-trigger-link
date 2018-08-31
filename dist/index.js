'use strict';

var apolloLink = require('apollo-link');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * A link to trigger data reception manually. E.g. to simulate subscription events.
 * You can't trigger induvidual operation without name.
 *
 * `setTriggers` function receives an object with available triggers.
 */

var ManualTriggerLink = function (_ApolloLink) {
  _inherits(ManualTriggerLink, _ApolloLink);

  function ManualTriggerLink(_ref) {
    var setTriggers = _ref.setTriggers;

    _classCallCheck(this, ManualTriggerLink);

    var _this = _possibleConstructorReturn(this, _ApolloLink.call(this));

    _this.trigger = function () {
      var nameToTrigger = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      var mockingParams = arguments[1];

      Object.keys(_this.calls).forEach(function (key) {
        var _this$calls$key = _this.calls[key],
            operation = _this$calls$key.operation,
            forward = _this$calls$key.forward,
            observers = _this$calls$key.observers;

        if (!nameToTrigger || operation.operationName === nameToTrigger) {
          operation.setContext({ mockingParams: mockingParams });
          _this.run(operation, forward, observers);
        }
      });
    };

    _this.inspect = function () {
      var inspection = Object.values(_this.calls);
      inspection.originalCalls = _this.calls;
      return inspection;
    };

    _this.updateTriggers = function () {
      var names = getNames(_this.calls);
      var triggers = {
        _all: function _all(mockingParams) {
          return _this.trigger(null, mockingParams);
        },
        _inspect: _this.inspect
      };
      names.forEach(function (name) {
        triggers[name] = function (mockingParams) {
          return _this.trigger(name, mockingParams);
        };
      });
      _this.setTriggersExternal(triggers);
    };

    _this.run = function (operation, forward, observers) {
      var subscription = forward(operation).subscribe({
        next: function next(result) {
          subscription.unsubscribe();
          observers.forEach(function (obs) {
            return obs.next(result);
          });
        },
        error: function error(_error) {
          subscription.unsubscribe();
          observers.forEach(function (obs) {
            return obs.error(_error);
          });
        }
      });
    };

    _this.reconcileObservers = function () {
      var deletable = Object.keys(_this.calls).reduce(function (acc, key) {
        _this.calls[key].observers = _this.calls[key].observers.filter(function (obs) {
          return !obs.closed;
        });
        if (!_this.calls[key].observers.length) {
          acc.push(key);
        }
        return acc;
      }, []);
      deletable.forEach(function (key) {
        return delete _this.calls[key];
      });
    };

    _this.request = function (operation, forward) {
      _this.reconcileObservers();
      return new apolloLink.Observable(function (observer) {
        var key = operation.toKey();
        if (_this.calls[key]) {
          _this.calls[key].observers.push(observer);
        } else {
          _this.calls[key] = {
            operation: operation,
            forward: forward,
            observers: [observer]
          };
          _this.updateTriggers();
        }
      });
    };

    _this.calls = {};
    _this.setTriggersExternal = setTriggers;
    return _this;
  }

  /**
   * Runs operations for calls by specified operation name,
   * or all operations, if operation name is not passed.
   */


  /**
   * Calls `setTriggers` passed via link options with an updated `triggers` object.
   * `triggers` object will contain `_all` and `_inspect` functions, and calls to `this.trigger` by operation name
   * (so all named operations can be triggered separatly).
   */


  /**
   * Runs an operation and passes the result for all registered observers.
   */


  /**
   * Drops observers, subscriptions for which are closed.
   */


  /**
   * Link entry point. Registers a call and returns an observable, which can be resolved when a corresponding
   * trigger is called.
   */


  return ManualTriggerLink;
}(apolloLink.ApolloLink);
function getNames(calls) {
  return Object.keys(calls).reduce(function (acc, key) {
    var name = calls[key].operation.operationName;

    if (name) {
      acc.push(name);
    }
    return acc;
  }, []);
}

module.exports = ManualTriggerLink;
