class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "AppError";
    this.message = message;
    this.statusCode = statusCode;
    this.code = code;

    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export default AppError;
