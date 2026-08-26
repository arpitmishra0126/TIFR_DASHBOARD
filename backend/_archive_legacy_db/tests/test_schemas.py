from sqlalchemy.orm import Session

from app.models import Child
from app.schemas import ChildRead


def test_child_read_serializes_from_orm_instance(db_session: Session):
    child = Child(redcap_child_id="06IND005B", sex="female", village="Test Village")
    db_session.add(child)
    db_session.commit()
    db_session.refresh(child)

    schema = ChildRead.model_validate(child)

    assert schema.redcap_child_id == "06IND005B"
    assert schema.sex == "female"
    assert schema.age_years is None
