use aws_sdk_dynamodb::error::ProvideErrorMetadata;
use serde::{Serialize, Serializer};
use std::error::Error;
use std::fmt;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Validation Error: {0}")]
    Validation(String),

    #[error("AWS Error [{code}]: {message}")]
    AwsService { code: String, message: String },

    #[error("Authentication Error: {0}")]
    Auth(String),

    #[error("Serialization Error: {0}")]
    Serialization(String),

    #[error("Internal Error: {0}")]
    Internal(String),
}

// Serialize as a clear, user-friendly error string for Tauri IPC rejection
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<E, R> From<aws_sdk_dynamodb::error::SdkError<E, R>> for AppError
where
    E: ProvideErrorMetadata + std::error::Error + 'static,
    R: fmt::Debug,
{
    fn from(err: aws_sdk_dynamodb::error::SdkError<E, R>) -> Self {
        match err {
            aws_sdk_dynamodb::error::SdkError::ServiceError(context) => {
                let err_ref = context.err();
                let code = err_ref.code().unwrap_or("ServiceError").to_string();
                let message = err_ref
                    .message()
                    .map(|m| m.to_string())
                    .unwrap_or_else(|| err_ref.to_string());
                AppError::AwsService { code, message }
            }
            aws_sdk_dynamodb::error::SdkError::TimeoutError(_) => AppError::AwsService {
                code: "TimeoutError".to_string(),
                message: "DynamoDB request timed out. Please check your network connection."
                    .to_string(),
            },
            aws_sdk_dynamodb::error::SdkError::DispatchFailure(df) => AppError::AwsService {
                code: "DispatchFailure".to_string(),
                message: format!("Network dispatch failure: {:?}", df),
            },
            other => {
                let mut msgs = Vec::new();
                let mut current = other.source();
                while let Some(src) = current {
                    let s = src.to_string();
                    if !s.is_empty() && !msgs.contains(&s) {
                        msgs.push(s);
                    }
                    current = src.source();
                }
                let msg = if msgs.is_empty() {
                    other.to_string()
                } else {
                    msgs.join(": ")
                };
                AppError::AwsService {
                    code: "SdkClientError".to_string(),
                    message: msg,
                }
            }
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Serialization(err.to_string())
    }
}

impl From<serde_dynamo::Error> for AppError {
    fn from(err: serde_dynamo::Error) -> Self {
        AppError::Serialization(err.to_string())
    }
}

impl From<String> for AppError {
    fn from(msg: String) -> Self {
        AppError::Internal(msg)
    }
}

impl From<&str> for AppError {
    fn from(msg: &str) -> Self {
        AppError::Internal(msg.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_serialization() {
        let err = AppError::AwsService {
            code: "ResourceNotFoundException".to_string(),
            message: "Table does not exist".to_string(),
        };
        assert_eq!(
            err.to_string(),
            "AWS Error [ResourceNotFoundException]: Table does not exist"
        );
        let serialized = serde_json::to_string(&err).unwrap();
        assert_eq!(
            serialized,
            "\"AWS Error [ResourceNotFoundException]: Table does not exist\""
        );
    }
}
