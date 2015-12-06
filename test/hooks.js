'use strict'

var test = require('tape')
var Router = require('../')

test('hooks', function (t) {
  t.test('global', function (t) {
    t.plan(2)

    var state = Router({
      path: '/packages/sour'
    })
    var values = []

    Router.route(state, {
      path: '/packages/:name',
      render: function () {
        return values.join(',')
      }
    })

    Router.hook(state, 'enter.before', function (params, callback) {
      t.deepEqual(params, {name: 'sour'})
      process.nextTick(function () {
        values.push(0)
        callback()
      })
    })

    Router.hook(state, 'enter.before', function (params, callback) {
      values.push(1)
      callback()
    })

    state.active(function onChange () {
      t.equal(Router.render(state()), '0,1')
    })

    Router.watch(state)
  })

  t.test('route', function (t) {
    t.plan(1)

    var state = Router({
      path: '/packages/sour'
    })
    var values = []

    var pkg = Router.route(state, {
      path: '/packages/:name',
      render: function () {
        return values.join(',')
      }
    })

    var other = Router.route(state, {
      path: '/other/route'
    })

    Router.hook(state, 'enter.before', function (params, callback) {
      values.push(0, 1)
      callback()
    })

    Router.hook(state, pkg, 'enter.before', function (params, callback) {
      values.push(2, 3)
      callback()
    })

    Router.hook(state, other, 'enter.before', function () {
      t.fail('other route hook called')
    })

    state.active(function onChange () {
      t.equal(Router.render(state()), '0,1,2,3')
    })

    Router.watch(state)
  })
})
