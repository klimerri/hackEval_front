from datetime import datetime

from pydantic import BaseModel, ConfigDict

class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    body: str
    created_at: datetime

class DashboardStats(BaseModel):
    active_hackathons: int = 0
    my_teams: int = 0
    total_submissions: int = 0
    pending_evaluations: int = 0
    assigned_hackathons: int = 0
    teams_to_grade: int = 0
    graded_by_me: int = 0
    managed_hackathons: int = 0
    total_teams: int = 0
    pending_teams: int = 0
    jury_total: int = 0

class DashboardHackathonRow(BaseModel):
    id: int
    title: str
    status: str
    deadline: datetime
    team: str
    score: str

class DashboardOut(BaseModel):
    role: str = "participant"
    stats: DashboardStats
    my_hackathons: list[DashboardHackathonRow]
    announcements: list[AnnouncementOut]
