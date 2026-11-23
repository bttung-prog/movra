export const getActorUserId = (user) => user?.userId || null;

export const getActorUserIdString = (user) => {
  const userId = getActorUserId(user);
  return userId ? String(userId) : null;
};

export const getReferenceIdString = (value) => {
  const id = value?._id || value;
  return id ? String(id) : null;
};
