from attrs import define


@define
class Task:
    task_id: str
    name: str
    description: str
    points: int = 1