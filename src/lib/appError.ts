/** Safe codes are public; never include user input or credentials in error messages. */
export class AppError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.name = new.target.name
    this.code = code
  }
}
export class DomainError extends AppError {}
export class ConfigurationError extends AppError {
  constructor() { super('invalid-configuration') }
}
