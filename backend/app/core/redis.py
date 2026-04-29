import json
from functools import wraps
from typing import Any, Callable
import redis.asyncio as redis
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()

redis_client = None

async def init_redis():
    global redis_client
    try:
        redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        await redis_client.ping()
        logger.info(f"✅ Connected to Redis at {settings.redis_url}")
    except Exception as e:
        logger.error(f"❌ Failed to connect to Redis: {e}")
        redis_client = None

async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.close()

def cache_response(expire: int = 60):
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not redis_client:
                return await func(*args, **kwargs)
            
            # Generate cache key based on function name and args
            key = f"cache:{func.__name__}:{hash(str(args) + str(kwargs))}"
            
            try:
                cached = await redis_client.get(key)
                if cached:
                    logger.debug(f"Cache hit for {key}")
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Redis get error: {e}")
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            if result is not None:
                try:
                    # Convert Pydantic models to dict if necessary, or assume response models handle it
                    to_cache = result.model_dump() if hasattr(result, "model_dump") else result
                    await redis_client.setex(key, expire, json.dumps(to_cache, default=str))
                except Exception as e:
                    logger.warning(f"Redis set error: {e}")
                    
            return result
        return wrapper
    return decorator
