export default function authenticateToken(req, res, next) {
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  req.user = userId;
  return next();
}
