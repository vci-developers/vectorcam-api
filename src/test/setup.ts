if (!(Object as any).hasOwn) {
  (Object as any).hasOwn = (target: object, property: PropertyKey) =>
    Object.prototype.hasOwnProperty.call(target, property);
}
