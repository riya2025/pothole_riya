from fastapi import APIRouter, Body
from pydantic import BaseModel

router = APIRouter(prefix="/api/social", tags=["social"])


class ShareRequest(BaseModel):
    issue_id: int
    issue_type: str
    address: str


class ShareResponse(BaseModel):
    tweet_text: str
    tweet_url: str
    ghmc_url: str


@router.post("/share", response_model=ShareResponse)
def generate_share(payload: ShareRequest):
    """Generate shareable social media content for a civic issue."""
    tweet_text = (
        f"🚨 Civic Issue Alert! A {payload.issue_type.upper()} has been reported at "
        f"{payload.address}. Please take action ASAP! #CivicIssue #{payload.issue_type.capitalize()} "
        f"#Hyderabad #GHMC (Issue #{payload.issue_id})"
    )
    encoded = tweet_text.replace(" ", "%20").replace("#", "%23").replace("!", "%21")
    tweet_url = f"https://twitter.com/intent/tweet?text={encoded}"
    ghmc_url = "https://ghmc.gov.in/Complaint.aspx"

    return ShareResponse(
        tweet_text=tweet_text,
        tweet_url=tweet_url,
        ghmc_url=ghmc_url,
    )
