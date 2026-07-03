from decimal import Decimal, ROUND_HALF_UP

from fastapi import FastAPI
from pydantic import BaseModel, Field


app = FastAPI(
    title="Calculadora de Correções Discursivas",
    version="4.0.0",
)


FIXED_LANGUAGE_PENALTY = Decimal("0.10")


class CalculationRequest(BaseModel):
    content_score: Decimal = Field(
        ge=0,
    )

    question_maximum_score: Decimal = Field(
        gt=0,
    )

    language_error_count: int = Field(
        default=0,
        ge=0,
    )

    score_precision: int = Field(
        default=2,
        ge=0,
        le=4,
    )


class CalculationResponse(BaseModel):
    content_score: float
    question_maximum_score: float

    language_error_count: int
    fixed_penalty_per_error: float
    language_discount: float

    raw_final_score: float
    final_score: float

    formula: str


def clamp(
    value: Decimal,
    minimum: Decimal,
    maximum: Decimal,
) -> Decimal:
    return max(minimum, min(value, maximum))


def round_decimal(
    value: Decimal,
    precision: int,
) -> Decimal:
    quantizer = Decimal("1").scaleb(-precision)

    return value.quantize(
        quantizer,
        rounding=ROUND_HALF_UP,
    )


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "correction-calculator",
        "version": "4.0.0",
        "calculation_mode": "direct_content_score",
        "language_rule": "fixed_penalty_per_error",
        "fixed_penalty_per_error": float(
            FIXED_LANGUAGE_PENALTY
        ),
    }


@app.post(
    "/calculate",
    response_model=CalculationResponse,
)
def calculate(
    payload: CalculationRequest,
) -> CalculationResponse:
    content_score = clamp(
        payload.content_score,
        Decimal("0"),
        payload.question_maximum_score,
    )

    language_discount = (
        Decimal(payload.language_error_count)
        * FIXED_LANGUAGE_PENALTY
    )

    raw_final_score = (
        content_score
        - language_discount
    )

    final_score = clamp(
        raw_final_score,
        Decimal("0"),
        payload.question_maximum_score,
    )

    return CalculationResponse(
        content_score=float(
            round_decimal(
                content_score,
                payload.score_precision,
            )
        ),

        question_maximum_score=float(
            round_decimal(
                payload.question_maximum_score,
                payload.score_precision,
            )
        ),

        language_error_count=(
            payload.language_error_count
        ),

        fixed_penalty_per_error=float(
            FIXED_LANGUAGE_PENALTY
        ),

        language_discount=float(
            round_decimal(
                language_discount,
                payload.score_precision,
            )
        ),

        raw_final_score=float(
            round_decimal(
                raw_final_score,
                payload.score_precision,
            )
        ),

        final_score=float(
            round_decimal(
                final_score,
                payload.score_precision,
            )
        ),

        formula=(
            "NC_MINUS_FIXED_PENALTY_TIMES_NE"
        ),
    )
