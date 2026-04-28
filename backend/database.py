# backend/database.py
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, timedelta
import os

_REPO_ROOT = Path(__file__).resolve().parent.parent
_default_db = _REPO_ROOT / "agrivision_community.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_default_db}")

# For SQLite, we need to use aiosqlite for async operations
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},  # Needed for SQLite
        echo=False
    )
else:
    engine = create_engine(DATABASE_URL, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Database Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)  # Clerk user ID
    email = Column(String, unique=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="author", cascade="all, delete-orphan")
    answers = relationship("Answer", back_populates="author", cascade="all, delete-orphan")
    success_stories = relationship("SuccessStory", back_populates="author", cascade="all, delete-orphan")
    group_memberships = relationship("GroupMembership", back_populates="user", cascade="all, delete-orphan")


class Post(Base):
    __tablename__ = "posts"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)
    author_id = Column(String, ForeignKey("users.id"))
    category = Column(String, default="general")  # general, question, discussion, etc.
    tags = Column(String)  # Comma-separated tags
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    author = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    author_id = Column(String, ForeignKey("users.id"))
    post_id = Column(Integer, ForeignKey("posts.id"))
    likes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    author = relationship("User", back_populates="comments")
    post = relationship("Post", back_populates="comments")


class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)
    author_id = Column(String, ForeignKey("users.id"))
    category = Column(String)  # crop, disease, fertilizer, etc.
    tags = Column(String)
    views = Column(Integer, default=0)
    is_answered = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    author = relationship("User", back_populates="questions")
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"
    
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    author_id = Column(String, ForeignKey("users.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    is_expert = Column(Boolean, default=False)  # Marked as expert answer
    is_accepted = Column(Boolean, default=False)  # Accepted by question author
    likes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    author = relationship("User", back_populates="answers")
    question = relationship("Question", back_populates="answers")


class SuccessStory(Base):
    __tablename__ = "success_stories"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)
    author_id = Column(String, ForeignKey("users.id"))
    crop_type = Column(String)
    region = Column(String)
    yield_increase = Column(Float)  # Percentage increase
    image_url = Column(String)  # URL to success story image
    likes = Column(Integer, default=0)
    views = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    author = relationship("User", back_populates="success_stories")


class RegionalGroup(Base):
    __tablename__ = "regional_groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text)
    region = Column(String, index=True)  # State/region name
    language = Column(String)  # Primary language
    member_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    memberships = relationship("GroupMembership", back_populates="group", cascade="all, delete-orphan")


class GroupMembership(Base):
    __tablename__ = "group_memberships"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    group_id = Column(Integer, ForeignKey("regional_groups.id"))
    role = Column(String, default="member")  # member, moderator, admin
    joined_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="group_memberships")
    group = relationship("RegionalGroup", back_populates="memberships")


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)
    category = Column(String, index=True)  # disease, crop, fertilizer, etc.
    tags = Column(String)
    author_id = Column(String, ForeignKey("users.id"))
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    author = relationship("User")


class Field(Base):
    __tablename__ = "fields"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    name = Column(String, index=True)
    area = Column(Float, default=0.0)
    area_unit = Column(String, default="ha")  # "ha" | "acre"
    soil_type = Column(String, default="")
    crop = Column(String, default="")
    sowing_date = Column(DateTime, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User")


class ActivityHistory(Base):
    __tablename__ = "activity_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    field_id = Column(Integer, ForeignKey("fields.id"), nullable=True, index=True)
    kind = Column(String, index=True)  # disease | crop_rec | yield | fertilizer
    summary = Column(String, default="")
    input_json = Column(Text, default="")
    output_json = Column(Text, default="")
    language = Column(String, default="en")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User")
    field = relationship("Field")


# Create tables
def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")
    seed_demo_community()


def seed_demo_community():
    """Idempotent demo content for forum, Q&A, groups, stories, and knowledge (offline demos)."""
    demo_author = "demo_user_priya"
    db = SessionLocal()
    try:
        if db.query(User).filter(User.id == demo_author).first():
            return
        if db.query(Post).count() > 0:
            return

        u_priya = User(
            id=demo_author,
            email="priya.k@demo.agrivision",
            first_name="Priya",
            last_name="Kaur",
        )
        u_amit = User(
            id="demo_user_amit",
            email="amit.p@demo.agrivision",
            first_name="Amit",
            last_name="Patel",
        )
        u_sarah = User(
            id="demo_user_sarah",
            email="sarah.o@demo.agrivision",
            first_name="Sarah",
            last_name="Okonjo",
        )
        u_james = User(
            id="demo_user_james",
            email="james.t@demo.agrivision",
            first_name="James",
            last_name="Thompson",
        )
        db.add_all([u_priya, u_amit, u_sarah, u_james])
        db.flush()

        t0 = datetime.utcnow()
        groups = [
            RegionalGroup(
                name="Northern Plains Growers Network",
                description="Wheat, rice, and mustard growers across Punjab & Haryana. Share mandi prices, weather windows, and variety trials.",
                region="Punjab & Haryana, India",
                language="Hindi, English",
                member_count=128,
                created_at=t0 - timedelta(days=120),
            ),
            RegionalGroup(
                name="Western Maharashtra Horticulture Hub",
                description="Tomato, grape, and onion — polytunnels, drip, and export compliance tips.",
                region="Maharashtra, India",
                language="Marathi, English",
                member_count=86,
                created_at=t0 - timedelta(days=90),
            ),
            RegionalGroup(
                name="East Africa Smallholder Maize Circle",
                description="Hybrid seed, fall armyworm scouting, and post-harvest loss reduction.",
                region="Kenya, Tanzania, Uganda",
                language="English, Kiswahili",
                member_count=54,
                created_at=t0 - timedelta(days=60),
            ),
            RegionalGroup(
                name="UK Allotment & No-Dig Collective",
                description="Raised beds, composting, and seasonal sowing calendars for cool climates.",
                region="United Kingdom",
                language="English",
                member_count=203,
                created_at=t0 - timedelta(days=200),
            ),
        ]
        db.add_all(groups)
        db.flush()

        post1 = Post(
            title="Side-dress nitrogen timing for irrigated wheat",
            content="""Our canal water came late this season and tillering looks uneven. For HD-3086 under flood irrigation, when are you all splitting the second N dose — at first node detectable, or strictly by calendar (roughly 30–32 DAS)? Also seeing a bit of yellowing on lighter patches: could be N or just wet feet?""",
            author_id=u_priya.id,
            category="general",
            tags="wheat,fertilizer,irrigation",
            views=142,
            likes=18,
            created_at=t0 - timedelta(days=4, hours=3),
        )
        post2 = Post(
            title="Tomato leaf curl in polyhouses — what actually worked?",
            content="""Whitefly pressure is brutal this cycle. We've tried reflective mulch + yellow traps; chemistry is last resort for our export buyer specs. Anyone compare resistant rootstocks vs. netting-only? Looking for practical SOP steps that survived a full season.""",
            author_id=u_amit.id,
            category="discussion",
            tags="tomato,ipm,greenhouse",
            views=89,
            likes=24,
            created_at=t0 - timedelta(days=2, hours=8),
        )
        post3 = Post(
            title="First fertigation under drip maize — EC and frequency",
            content="""Switching 4 ha from flood to drip for spring maize. Water quality report attached at lab (moderate bicarbonates). Starter plan: light NPK every 2–3 days after V6 — too aggressive? Love to hear your panel EC targets at salinity ~0.8 mS/cm soil.""",
            author_id=u_sarah.id,
            category="general",
            tags="maize,drip,fertigation",
            views=56,
            likes=9,
            created_at=t0 - timedelta(days=1, hours=5),
        )
        db.add_all([post1, post2, post3])
        db.flush()

        db.add_all(
            [
                Comment(
                    content="We aim for first N split when the first node is palpable (~Feekes 5–6). On silt loam we skip calendar-only — too risky if winter rain leaches early N.",
                    author_id=u_amit.id,
                    post_id=post1.id,
                    likes=6,
                    created_at=t0 - timedelta(days=3, hours=2),
                ),
                Comment(
                    content="Yellow streaks in low spots: worth a nitrate quick test before more urea. We've mistaken waterlogging stress for N deficiency twice.",
                    author_id=u_james.id,
                    post_id=post1.id,
                    likes=4,
                    created_at=t0 - timedelta(days=3, hours=5),
                ),
                Comment(
                    content="If you're export-only, netting + rouging + banker plants bought us enough time to reduce sprays by half last year.",
                    author_id=u_priya.id,
                    post_id=post2.id,
                    likes=11,
                    created_at=t0 - timedelta(days=2, hours=1),
                ),
            ]
        )

        q1 = Question(
            title="Zinc for transplanted rice on heavy clay — soil or foliar first?",
            content="""Field history: continuous rice–wheat, Zn showing low on recent soil test (0.55 ppm DTPA). Transplanting in 10 days. Prefer minimal foliar passes if a basal soil application can catch typical hidden hunger symptoms.""",
            author_id=u_james.id,
            category="fertilizer",
            tags="rice,zinc,clay",
            views=67,
            is_answered=True,
            created_at=t0 - timedelta(days=5),
        )
        q2 = Question(
            title="Row spacing for chili on raised beds (drip)",
            content="""Twin rows per bed or single row down the crown? Planting 10k seedlings — need wind strategy and picking lane width for two workers.""",
            author_id=u_amit.id,
            category="crop",
            tags="chili,spacing,drip",
            views=34,
            is_answered=True,
            created_at=t0 - timedelta(days=3),
        )
        q3 = Question(
            title="Organic options for early blight pressure on potatoes?",
            content="""Humid week forecast. Copper rotation schedule vs. biofungicide — what hold intervals are you using pre-harvest? EU-bound tubers.""",
            author_id=u_sarah.id,
            category="disease",
            tags="potato,organic,early-blight",
            views=21,
            is_answered=False,
            created_at=t0 - timedelta(hours=18),
        )
        db.add_all([q1, q2, q3])
        db.flush()

        db.add_all(
            [
                Answer(
                    content="Basal zinc sulphate (soil-grade) at transplant lining water worked better for us than first foliar only — especially on clays that tie up Zn. We still do one foliar chelate at mid-tillering if symptoms creep in.",
                    author_id=u_priya.id,
                    question_id=q1.id,
                    is_expert=True,
                    is_accepted=True,
                    likes=14,
                    created_at=t0 - timedelta(days=4, hours=4),
                ),
                Answer(
                    content="We run 90 cm beds, single row on crown, 45 cm plant spacing; twin rows competed for light in our latitude. Two pickers need ~55–60 cm aisle — measure with a wheelbarrow pass test before staking.",
                    author_id=u_james.id,
                    question_id=q2.id,
                    is_expert=False,
                    is_accepted=True,
                    likes=8,
                    created_at=t0 - timedelta(days=2, hours=6),
                ),
            ]
        )

        db.add_all(
            [
                SuccessStory(
                    title="Wheat strip trial: +18% grain with split N + surfactant",
                    content="""Three seasons comparing flat-rate urea vs. split N with mild surfactant on canal irrigation. Lodging dropped, protein stable, combine fuel down slightly. Biggest win was fewer yellow hotspots at heading.""",
                    author_id=u_priya.id,
                    crop_type="Wheat",
                    region="Punjab, India",
                    yield_increase=18.0,
                    image_url=None,
                    likes=31,
                    views=412,
                    created_at=t0 - timedelta(days=30),
                ),
                SuccessStory(
                    title="Tomato packhouse rejects halved after drip + EC monitoring",
                    content="""Moved from flood to drip with weekly substrate-style drainage checks in soil. Packhouse Brix variance tightened; reject line mostly cosmetic now.""",
                    author_id=u_amit.id,
                    crop_type="Tomato",
                    region="Maharashtra, India",
                    yield_increase=12.0,
                    likes=27,
                    views=285,
                    created_at=t0 - timedelta(days=45),
                ),
                SuccessStory(
                    title="Maize: fewer barren cobs after last minute planter down-pressure fix",
                    content="""Dry spell at planting; uneven depth was killing stand on headlands. Shims + slower speed recovered population without re-planting.""",
                    author_id=u_sarah.id,
                    crop_type="Maize",
                    region="Western Kenya",
                    yield_increase=9.5,
                    likes=15,
                    views=156,
                    created_at=t0 - timedelta(days=14),
                ),
            ]
        )

        db.add_all(
            [
                KnowledgeArticle(
                    title="Reading nitrogen deficiency vs. drought stress in cereals",
                    content="""Older leaf yellowing starting at the tip and moving backward often points to mobile N shortage — but rule out shallow roots from compaction first. Quick nitrate soil test or SPAD comparing upper vs. lower canopy helps separate N from drought-induced firing (often whole-leaf bronze, margins first). Match rescue N to growth stage: too late at hard dough does little for yield but can affect protein. Always check licensing and grazing restrictions if livestock access fields.""",
                    category="fertilizer",
                    tags="nitrogen,cereals,scouting",
                    author_id=u_amit.id,
                    views=520,
                    likes=41,
                    is_featured=True,
                    created_at=t0 - timedelta(days=400),
                ),
                KnowledgeArticle(
                    title="Soil pH, liming, and nutrient availability — a practical checklist",
                    content="""Target pH depends on crop rotation: most field crops run well ~6.0–6.8. Lime reacts slowly — apply well ahead of acid-loving crops if you must share fields. Grid or zone sampling beats single composite on variable fields. Retest every 3–4 years or after major amendment programs.""",
                    category="soil",
                    tags="ph,liming,soil-health",
                    author_id=u_james.id,
                    views=380,
                    likes=29,
                    is_featured=False,
                    created_at=t0 - timedelta(days=350),
                ),
                KnowledgeArticle(
                    title="IPM basics for fungal leaf spots in vegetables",
                    content="""Scout lower canopy weekly; many pathogens splash from soil. Early removal of infected trash, wider row air movement, and avoiding evening irrigation all buy time. Rotate chemistries (FRAC codes) if you must spray; document PHI for every market. Combine cultural + biologicals where buyers allow; record humidity hours for model-friendly decisions later.""",
                    category="disease",
                    tags="ipm,fungal,vegetables",
                    author_id=u_sarah.id,
                    views=290,
                    likes=22,
                    is_featured=True,
                    created_at=t0 - timedelta(days=300),
                ),
            ]
        )

        db.commit()
        print("Demo community content seeded (forum, Q&A, groups, stories, knowledge).")
    except Exception as e:
        db.rollback()
        print(f"Demo community seed skipped: {e}")
    finally:
        db.close()


# Get database session
def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

