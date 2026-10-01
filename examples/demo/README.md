# Eventa demo

A tiny project with a crash, a buggy diff and outdated dependencies, so you can try every command in under a minute.

```bash
cd examples/demo
npm install

# 1. explain a crash
npx @jeeva1398/eventa explain --run "node src/users.js"

# 2. review a buggy change (missing await, SQL injection, empty catch)
cp orders.js.example src/orders.js && git add src/orders.js
npx @jeeva1398/eventa review
git reset -q src/orders.js && rm src/orders.js

# 3. audit dependencies (vulnerable lodash/express, Express 5 upgrade notes)
npx @jeeva1398/eventa deps
```
