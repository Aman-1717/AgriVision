# backend/community_api.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from .database import (
    get_db,
    User,
    Post,
    Comment,
    Question,
    Answer,
    SuccessStory,
    RegionalGroup,
    GroupMembership,
    KnowledgeArticle,
)
from .auth import verify_clerk_session

router = APIRouter(prefix="/api/community", tags=["community"])

# Helper to get user_id from request
async def get_user_id(request: Request) -> Optional[str]:
    """Get user ID from Clerk session"""
    user = await verify_clerk_session(request)
    if user:
        return user.get('id')
    return None


# Pydantic Models for Request/Response
class PostCreate(BaseModel):
    title: str
    content: str
    category: str = "general"
    tags: Optional[str] = None


class CommentCreate(BaseModel):
    content: str
    post_id: int


class QuestionCreate(BaseModel):
    title: str
    content: str
    category: str
    tags: Optional[str] = None


class AnswerCreate(BaseModel):
    content: str
    question_id: int
    is_expert: bool = False


class SuccessStoryCreate(BaseModel):
    title: str
    content: str
    crop_type: str
    region: str
    yield_increase: Optional[float] = None
    image_url: Optional[str] = None


class KnowledgeArticleCreate(BaseModel):
    title: str
    content: str
    category: str
    tags: Optional[str] = None


# Helper function to get or create user
async def get_or_create_user_from_request(db: Session, request: Request):
    """Get or create user from Clerk session"""
    user_data = await verify_clerk_session(request)
    if not user_data:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user_data.get('id')
    email = user_data.get('email_addresses', [{}])[0].get('email_address', '') if user_data.get('email_addresses') else ''
    first_name = user_data.get('first_name', 'User')
    last_name = user_data.get('last_name', '')
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(
            id=user_id,
            email=email or f"{user_id}@agrivision.com",
            first_name=first_name or "User",
            last_name=last_name or ""
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update user info if changed
        if email and user.email != email:
            user.email = email
        if first_name and user.first_name != first_name:
            user.first_name = first_name
        if last_name and user.last_name != last_name:
            user.last_name = last_name
        db.commit()
    
    return user


# Forum Posts Endpoints
@router.post("/posts")
async def create_post(post: PostCreate, request: Request, db: Session = Depends(get_db)):
    """Create a new forum post"""
    user = await get_or_create_user_from_request(db, request)
    db_post = Post(
        title=post.title,
        content=post.content,
        category=post.category,
        tags=post.tags,
        author_id=user.id
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return {"id": db_post.id, "message": "Post created successfully"}


@router.get("/posts")
async def get_posts(
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get forum posts with pagination and filters"""
    query = db.query(Post)
    
    if category:
        query = query.filter(Post.category == category)
    
    if search:
        query = query.filter(
            or_(
                Post.title.contains(search),
                Post.content.contains(search)
            )
        )
    
    posts = query.order_by(desc(Post.created_at)).offset(skip).limit(limit).all()
    total = query.count()
    
    return {
        "posts": [
            {
                "id": p.id,
                "title": p.title,
                "content": p.content[:200] + "..." if len(p.content) > 200 else p.content,
                "author": p.author.first_name if p.author else "Unknown",
                "category": p.category,
                "tags": p.tags.split(",") if p.tags else [],
                "views": p.views,
                "likes": p.likes,
                "comments_count": len(p.comments),
                "created_at": p.created_at.isoformat()
            }
            for p in posts
        ],
        "total": total
    }


@router.get("/posts/{post_id}")
async def get_post(post_id: int, db: Session = Depends(get_db)):
    """Get a single post with comments"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Increment views
    post.views += 1
    db.commit()
    
    return {
        "id": post.id,
        "title": post.title,
        "content": post.content,
        "author": {
            "id": post.author.id,
            "name": f"{post.author.first_name} {post.author.last_name}".strip(),
            "email": post.author.email
        },
        "category": post.category,
        "tags": post.tags.split(",") if post.tags else [],
        "views": post.views,
        "likes": post.likes,
        "comments": [
            {
                "id": c.id,
                "content": c.content,
                "author": c.author.first_name if c.author else "Unknown",
                "likes": c.likes,
                "created_at": c.created_at.isoformat()
            }
            for c in post.comments
        ],
        "created_at": post.created_at.isoformat()
    }


@router.post("/posts/{post_id}/like")
async def like_post(post_id: int, db: Session = Depends(get_db)):
    """Like a post"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.likes += 1
    db.commit()
    return {"likes": post.likes}


@router.post("/comments")
async def create_comment(comment: CommentCreate, request: Request, db: Session = Depends(get_db)):
    """Create a comment on a post"""
    user = await get_or_create_user_from_request(db, request)
    db_comment = Comment(
        content=comment.content,
        post_id=comment.post_id,
        author_id=user.id
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return {"id": db_comment.id, "message": "Comment added successfully"}


# Q&A Endpoints
@router.post("/questions")
async def create_question(question: QuestionCreate, request: Request, db: Session = Depends(get_db)):
    """Create a new question"""
    user = await get_or_create_user_from_request(db, request)
    db_question = Question(
        title=question.title,
        content=question.content,
        category=question.category,
        tags=question.tags,
        author_id=user.id
    )
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    return {"id": db_question.id, "message": "Question posted successfully"}


@router.get("/questions")
async def get_questions(
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    answered: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Get questions with filters"""
    query = db.query(Question)
    
    if category:
        query = query.filter(Question.category == category)
    
    if answered is not None:
        query = query.filter(Question.is_answered == answered)
    
    questions = query.order_by(desc(Question.created_at)).offset(skip).limit(limit).all()
    total = query.count()
    
    return {
        "questions": [
            {
                "id": q.id,
                "title": q.title,
                "content": q.content[:200] + "..." if len(q.content) > 200 else q.content,
                "author": q.author.first_name if q.author else "Unknown",
                "category": q.category,
                "tags": q.tags.split(",") if q.tags else [],
                "views": q.views,
                "is_answered": q.is_answered,
                "answers_count": len(q.answers),
                "created_at": q.created_at.isoformat()
            }
            for q in questions
        ],
        "total": total
    }


@router.get("/questions/{question_id}")
async def get_question(question_id: int, db: Session = Depends(get_db)):
    """Get a single question with answers"""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    question.views += 1
    db.commit()
    
    return {
        "id": question.id,
        "title": question.title,
        "content": question.content,
        "author": {
            "id": question.author.id,
            "name": f"{question.author.first_name} {question.author.last_name}".strip()
        },
        "category": question.category,
        "tags": question.tags.split(",") if question.tags else [],
        "views": question.views,
        "is_answered": question.is_answered,
        "answers": [
            {
                "id": a.id,
                "content": a.content,
                "author": a.author.first_name if a.author else "Unknown",
                "is_expert": a.is_expert,
                "is_accepted": a.is_accepted,
                "likes": a.likes,
                "created_at": a.created_at.isoformat()
            }
            for a in sorted(question.answers, key=lambda x: (x.is_accepted, x.is_expert, x.likes), reverse=True)
        ],
        "created_at": question.created_at.isoformat()
    }


@router.post("/answers")
async def create_answer(answer: AnswerCreate, request: Request, db: Session = Depends(get_db)):
    """Create an answer to a question"""
    user = await get_or_create_user_from_request(db, request)
    question = db.query(Question).filter(Question.id == answer.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    db_answer = Answer(
        content=answer.content,
        question_id=answer.question_id,
        author_id=user.id,
        is_expert=answer.is_expert
    )
    db.add(db_answer)
    
    # Mark question as answered if not already
    if not question.is_answered:
        question.is_answered = True
    
    db.commit()
    db.refresh(db_answer)
    return {"id": db_answer.id, "message": "Answer posted successfully"}


@router.post("/answers/{answer_id}/accept")
async def accept_answer(answer_id: int, request: Request, db: Session = Depends(get_db)):
    """Accept an answer (only question author can do this)"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    answer = db.query(Answer).filter(Answer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    
    if answer.question.author_id != user_id:
        raise HTTPException(status_code=403, detail="Only question author can accept answers")
    
    # Unaccept other answers
    for a in answer.question.answers:
        a.is_accepted = False
    
    answer.is_accepted = True
    db.commit()
    return {"message": "Answer accepted"}


# Success Stories Endpoints
@router.post("/success-stories")
async def create_success_story(story: SuccessStoryCreate, request: Request, db: Session = Depends(get_db)):
    """Create a success story"""
    user = await get_or_create_user_from_request(db, request)
    db_story = SuccessStory(
        title=story.title,
        content=story.content,
        crop_type=story.crop_type,
        region=story.region,
        yield_increase=story.yield_increase,
        image_url=story.image_url,
        author_id=user.id
    )
    db.add(db_story)
    db.commit()
    db.refresh(db_story)
    return {"id": db_story.id, "message": "Success story created successfully"}


@router.get("/success-stories")
async def get_success_stories(
    skip: int = 0,
    limit: int = 20,
    region: Optional[str] = None,
    crop_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get success stories with filters"""
    query = db.query(SuccessStory)
    
    if region:
        query = query.filter(SuccessStory.region == region)
    
    if crop_type:
        query = query.filter(SuccessStory.crop_type == crop_type)
    
    stories = query.order_by(desc(SuccessStory.created_at)).offset(skip).limit(limit).all()
    total = query.count()
    
    return {
        "stories": [
            {
                "id": s.id,
                "title": s.title,
                "content": s.content[:300] + "..." if len(s.content) > 300 else s.content,
                "author": s.author.first_name if s.author else "Unknown",
                "crop_type": s.crop_type,
                "region": s.region,
                "yield_increase": s.yield_increase,
                "image_url": s.image_url,
                "likes": s.likes,
                "views": s.views,
                "created_at": s.created_at.isoformat()
            }
            for s in stories
        ],
        "total": total
    }


# Regional Groups Endpoints
@router.get("/groups")
async def get_groups(db: Session = Depends(get_db)):
    """Get all regional groups"""
    groups = db.query(RegionalGroup).order_by(RegionalGroup.member_count.desc()).all()
    return {
        "groups": [
            {
                "id": g.id,
                "name": g.name,
                "description": g.description,
                "region": g.region,
                "language": g.language,
                "member_count": g.member_count
            }
            for g in groups
        ]
    }


@router.post("/groups/{group_id}/join")
async def join_group(group_id: int, request: Request, db: Session = Depends(get_db)):
    """Join a regional group"""
    user = await get_or_create_user_from_request(db, request)
    group = db.query(RegionalGroup).filter(RegionalGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if already a member
    existing = db.query(GroupMembership).filter(
        GroupMembership.user_id == user.id,
        GroupMembership.group_id == group_id
    ).first()
    
    if existing:
        return {"message": "Already a member"}
    
    membership = GroupMembership(user_id=user.id, group_id=group_id)
    db.add(membership)
    group.member_count += 1
    db.commit()
    return {"message": "Joined group successfully"}


# Knowledge Base Endpoints
@router.post("/knowledge")
async def create_article(article: KnowledgeArticleCreate, request: Request, db: Session = Depends(get_db)):
    """Create a knowledge base article"""
    user = await get_or_create_user_from_request(db, request)
    db_article = KnowledgeArticle(
        title=article.title,
        content=article.content,
        category=article.category,
        tags=article.tags,
        author_id=user.id
    )
    db.add(db_article)
    db.commit()
    db.refresh(db_article)
    return {"id": db_article.id, "message": "Article created successfully"}


@router.get("/knowledge")
async def get_articles(
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    featured: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get knowledge base articles"""
    query = db.query(KnowledgeArticle)
    
    if category:
        query = query.filter(KnowledgeArticle.category == category)
    
    if featured is not None:
        query = query.filter(KnowledgeArticle.is_featured == featured)
    
    if search:
        query = query.filter(
            or_(
                KnowledgeArticle.title.contains(search),
                KnowledgeArticle.content.contains(search)
            )
        )
    
    articles = query.order_by(desc(KnowledgeArticle.created_at)).offset(skip).limit(limit).all()
    total = query.count()
    
    return {
        "articles": [
            {
                "id": a.id,
                "title": a.title,
                "content": a.content[:300] + "..." if len(a.content) > 300 else a.content,
                "author": a.author.first_name if a.author else "Unknown",
                "category": a.category,
                "tags": a.tags.split(",") if a.tags else [],
                "views": a.views,
                "likes": a.likes,
                "is_featured": a.is_featured,
                "created_at": a.created_at.isoformat()
            }
            for a in articles
        ],
        "total": total
    }


@router.get("/knowledge/{article_id}")
async def get_article(article_id: int, db: Session = Depends(get_db)):
    """Get a single knowledge base article"""
    article = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    article.views += 1
    db.commit()
    
    return {
        "id": article.id,
        "title": article.title,
        "content": article.content,
        "author": {
            "id": article.author.id,
            "name": f"{article.author.first_name} {article.author.last_name}".strip()
        },
        "category": article.category,
        "tags": article.tags.split(",") if article.tags else [],
        "views": article.views,
        "likes": article.likes,
        "is_featured": article.is_featured,
        "created_at": article.created_at.isoformat()
    }

