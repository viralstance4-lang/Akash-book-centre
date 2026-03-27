declare global {
  namespace Express {
    interface Request {
      cookies: Record<string, string | undefined>;
      file?: import("multer").File;
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export {};
