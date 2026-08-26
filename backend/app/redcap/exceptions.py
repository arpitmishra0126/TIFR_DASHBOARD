"""Exceptions for the REDCap integration boundary."""


class RedCapError(Exception):
    """Base exception for all REDCap integration failures."""


class RedCapNotConfiguredError(RedCapError):
    """Raised when REDCAP_API_URL / REDCAP_API_TOKEN / REDCAP_PROJECT_ID are missing.

    This is the expected error at this stage of the project — no live
    credentials have been supplied yet.
    """


class RedCapAPIError(RedCapError):
    """Raised when REDCap returns a non-success HTTP response."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class RedCapResponseValidationError(RedCapError):
    """Raised when a REDCap response does not match the expected shape."""
