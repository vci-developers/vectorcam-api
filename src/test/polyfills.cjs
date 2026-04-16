if (!Object.hasOwn) {
  Object.hasOwn = function hasOwn(target, property) {
    return Object.prototype.hasOwnProperty.call(target, property);
  };
}
