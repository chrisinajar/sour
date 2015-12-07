'use strict'

var Struct = require('observ-struct')
var Observ = require('observ')
var Path = require('observ-path')
var Table = require('tafel')
var series = require('run-series')
var partial = require('ap').partial
var Event = require('weakmap-event')
var filter = require('filter-pipe')
var watchIf = require('observ-listen-if/watch')
var createStore = require('weakmap-shim/create-store')
var assign = require('xtend/mutable')
var nextTick = require('next-tick')

var hooks = require('./hooks')

module.exports = Router

var store = createStore()

function Router (data) {
  data = data || {}

  var state = Struct({
    path: Path(data.path),
    watching: Observ(false),
    active: Observ(),
    params: Observ({})
  })

  createTable(state)
  hooks.create(state)

  watchIf(
    state.watching,
    state.path,
    partial(onPath, state)
  )

  return state
}

var NotFoundEvent = Event()
Router.onNotFound = NotFoundEvent.listen

var ErrorEvent = Event()
Router.onError = ErrorEvent.listen

Router.watch = function watch (state) {
  state.watching.set(true)
}

function onPath (state, path) {
  var match = routes(state).match(path)
  if (!match) {
    return NotFoundEvent.broadcast(state, {
      path: path
    })
  }
  Router.transition(state, match.key, match.params)
}

Router.transition = function transition (state, route, params, callback) {
  var current = hookRunner(state, state.active(), state.params())
  var next = hookRunner(state, route, params)

  var fail = filter(Boolean, partial(ErrorEvent.broadcast, state))
  callback = callback || noop

  series([
    partial(current, 'leave.before'),
    partial(current, 'leave.after'),
    partial(next, 'enter.before'),
    enter
  ], done)

  function enter (callback) {
    activate(state, {
      route: route,
      params: params
    })
    callback(null)
    next('enter.after', fail)
  }

  function done (err) {
    fail(err)
    callback(err)
  }
}

Router.route = function route (state, options) {
  return routes(state).add(options)
}

var hookPoints = {
  beforeEnter: 'enter.before',
  afterEnter: 'enter.after',
  beforeLeave: 'leave.before',
  afterLeave: 'leave.after'
}

Object.keys(hookPoints).forEach(function (key) {
  Router[key] = function hook (state, route, fn) {
    if (typeof route === 'function') {
      fn = route
      route = null
    }

    return hooks.add(route || state, hookPoints[key], fn)
  }
})

Router.render = function render (state) {
  if (!state.active) return
  return store(state.active).render()
}

function activate (state, options) {
  state.active.set(options.route)
  state.params.set(options.params)
}

function createTable (state) {
  store(state).table = Table()
}

function table (state) {
  return store(state).table
}

function routes (state) {
  return {
    add: add,
    match: match
  }

  function add (options) {
    var key = table(state).add(options.path)
    assign(store(key), options)
    hooks.create(key)
    return key
  }

  function match (path) {
    return table(state).match(path)
  }
}

function hookRunner (state, route, params) {
  if (!route) return noopHook

  return function runner (type, callback) {
    series([run(state, params), run(route, params)], callback)

    function run (key, arg) {
      return partial(hooks.get(type, key), arg)
    }
  }
}

function noopHook (type, callback) {
  nextTick(callback)
}

function noop () {}
