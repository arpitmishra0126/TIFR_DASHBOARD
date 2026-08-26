from datetime import date

from sqlalchemy.orm import Session

from app.models import AssessmentProgress, Child, SESProfile


def test_child_can_be_created_with_minimal_fields(db_session: Session):
    child = Child(redcap_child_id="06IND001B", sex="male", registration_complete=True)
    db_session.add(child)
    db_session.commit()

    fetched = db_session.query(Child).filter_by(redcap_child_id="06IND001B").one()
    assert fetched.sex == "male"
    assert fetched.registration_complete is True
    assert fetched.dob is None


def test_redcap_child_id_is_unique(db_session: Session):
    db_session.add(Child(redcap_child_id="06IND002B"))
    db_session.commit()

    db_session.add(Child(redcap_child_id="06IND002B"))
    with_error = False
    try:
        db_session.commit()
    except Exception:
        with_error = True
        db_session.rollback()
    assert with_error


def test_ses_profile_relates_to_child(db_session: Session):
    child = Child(redcap_child_id="06IND003B")
    db_session.add(child)
    db_session.flush()

    ses = SESProfile(child_id=child.id, udai_pareek_score=42.0, household_size=5)
    db_session.add(ses)
    db_session.commit()

    assert child.ses_profile.udai_pareek_score == 42.0


def test_assessment_progress_defaults_to_not_started(db_session: Session):
    child = Child(redcap_child_id="06IND004B")
    db_session.add(child)
    db_session.flush()

    progress = AssessmentProgress(child_id=child.id)
    db_session.add(progress)
    db_session.commit()

    assert progress.overall_status == "Not Started"
    assert progress.registration_complete is False
