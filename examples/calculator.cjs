'use strict';
function total(items, discount = 0) {
  if (!Array.isArray(items) || discount < 0 || discount > 1) throw new Error('Invalid order');
  return Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * (1 - discount) * 100) / 100;
}
module.exports = { total };
