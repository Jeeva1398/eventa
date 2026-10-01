const users = [{ id: 1, profile: { name: 'Ada' } }, { id: 2 }];

export function displayName(id) {
  const user = users.find((u) => u.id === id);
  return user.profile.name.toUpperCase();
}

console.log(displayName(1));
console.log(displayName(2));
