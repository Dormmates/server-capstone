export const mask = (text) => {
  return btoa(text);
};

export const unmask = (b64) => {
  return atob(b64);
};
