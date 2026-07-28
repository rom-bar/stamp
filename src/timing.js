// Tiny promise-based delay helper, used to sequence animation timing
// (e.g. "wait N ms for the award animation to finish, then clear the draft").
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
