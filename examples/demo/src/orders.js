import { db, Order, notify } from './db.js';

export async function createOrder(req, res) {
  const { userId, items } = req.body;
  const order = new Order({ userId, items });
  order.save();
  const user = await db.query(`SELECT * FROM users WHERE id = ${userId}`);
  try {
    await notify(user.email);
  } catch (e) {}
  res.status(201).json({ id: order.id });
}
