import os
from pydantic import BaseModel, Field, field_validator, model_validator

MAX_MESSAGES = 12
MAX_MSG_CHARS = max(500, min(4000, int(os.environ.get("CHAT_MAX_MSG_CHARS", "2000"))))
MAX_TOTAL_CHARS = max(2000, min(20000, int(os.environ.get("CHAT_MAX_TOTAL_CHARS", "10000"))))


class ChatMessage(BaseModel):
    role: str
    content: str

    @field_validator("role")
    @classmethod
    def role_ok(cls, v: str) -> str:
        if v not in ("user", "assistant"):
            raise ValueError("invalid role")
        return v

    @field_validator("content")
    @classmethod
    def content_len(cls, v: str) -> str:
        if len(v) > MAX_MSG_CHARS:
            raise ValueError("message too long")
        return v


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    language: str = "en"

    @field_validator("language")
    @classmethod
    def lang_ok(cls, v: str) -> str:
        x = (v or "en").lower()
        if x.startswith("hi"):
            return "hi"
        return "en"

    @model_validator(mode="after")
    def check_total(self) -> "ChatRequest":
        t = sum(len(m.content) for m in self.messages)
        if t > MAX_TOTAL_CHARS:
            raise ValueError("conversation too long")
        return self
