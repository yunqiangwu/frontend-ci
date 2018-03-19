
/* eslint no-underscore-dangle:0 */

function isFunction(arg) {
  return Object.prototype.toString.call(arg) === '[object Function]';
}
function isObject(arg) {
  return Object.prototype.toString.call(arg) === '[object Object]';
}

// 从 key 中获取 method 和 url
function parseKey(key) {
  const arr = key.split(' ');
  const method = arr[0];
  const url = arr[1];
  return {
    method,
    url,
  };
}


export default {
  isFunction,
  isObject,
  parseKey,
};
