'use strict'

exports.render = function render (state, match) {
  var matched = match(state)
  return matched && matched.fn(matched.params)
}