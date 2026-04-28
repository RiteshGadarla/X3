import asyncio
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.role import Role
from app.models.ticket import Ticket
from app.models.sla_config import SLAConfig
from app.core.security import hash_password
from sqlalchemy import select

async def seed_extra_users():
    async with AsyncSessionLocal() as db:
        roles_result = await db.execute(select(Role))
        roles = roles_result.scalars().all()
        role_map = {r.name: r.id for r in roles}

        users_to_add = [
            {
                "email": "agent@csagent.ai",
                "full_name": "Sarah Agent",
                "password": "Agent@1234!",
                "role": "Support Agent"
            },
            {
                "email": "manager@csagent.ai",
                "full_name": "Mike Manager",
                "password": "Manager@1234!",
                "role": "Manager"
            },
            {
                "email": "vp@csagent.ai",
                "full_name": "Victoria VP",
                "password": "VP@1234!",
                "role": "VP Customer Success"
            },
            {
                "email": "legal@csagent.ai",
                "full_name": "Larry Legal",
                "password": "Legal@1234!",
                "role": "Legal"
            }
        ]

        for u_data in users_to_add:
            existing = await db.execute(select(User).where(User.email == u_data["email"]))
            if not existing.scalar_one_or_none():
                user = User(
                    email=u_data["email"],
                    full_name=u_data["full_name"],
                    hashed_password=hash_password(u_data["password"]),
                    role_id=role_map.get(u_data["role"]),
                    is_active=True
                )
                db.add(user)
                print(f"Added user: {u_data['email']} ({u_data['role']})")
        
        await db.commit()
        print("Extra users seeded successfully.")

if __name__ == "__main__":
    asyncio.run(seed_extra_users())
