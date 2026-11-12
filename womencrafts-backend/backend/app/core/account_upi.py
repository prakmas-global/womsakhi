"""One receiving UPI per account. Legacy listing values are read-only fallbacks."""
import re
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException

UPI_PATTERN = re.compile(r'^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$')


def valid_upi(value: str) -> bool:
    return bool(value and len(value)<=80 and UPI_PATTERN.fullmatch(value.strip()))


async def recipient_upi(db, owner_id: str, legacy: str = '') -> str:
    if not owner_id or not ObjectId.is_valid(owner_id):
        return legacy
    user=await db.users.find_one({'_id':ObjectId(owner_id)}, {'payment_upi_id':1})
    if user is not None and 'payment_upi_id' in user:
        return user.get('payment_upi_id') or ''
    return legacy


async def account_upi(db, me: dict) -> dict:
    user=await db.users.find_one({'_id':me['_id']},{'payment_upi_id':1,'payment_upi_updated_at':1})
    value=(user or {}).get('payment_upi_id') or ''
    candidates=set()
    if not value:
        uid=str(me['_id'])
        for collection,query in [('programs',{'owner_id':uid}),('mentors',{'owner_id':uid}),('payout_accounts',{'user_id':uid,'kind':'UPI'})]:
            async for row in db[collection].find(query,{'upi_id':1}).limit(200):
                old=row.get('upi_id') or ''
                if valid_upi(old):candidates.add(old.strip())
    return {'upi_id':value,'configured':bool(value),'existing_upi_ids':sorted(candidates),
            'updated_at':(user or {}).get('payment_upi_updated_at')}


async def freeze_submitted_upi(db, owner_id: str):
    # Older submitted claims lack a destination snapshot. Preserve their
    # listing's existing ID before the account default or listing changes.
    for collection,claims,key in [('programs','enrollments','program_id'),('mentors','mentorship_requests','mentor_id')]:
        groups={}
        async for row in db[collection].find({'owner_id':owner_id},{'upi_id':1}):
            groups.setdefault(row.get('upi_id') or '',[]).append(str(row['_id']))
        for address,ids in groups.items():
            await db[claims].update_many({key:{'$in':ids},'payment.status':'claimed','payment.upi_id':{'$exists':False}},
                {'$set':{'payment.upi_id':address}})


async def set_account_upi(db, me: dict, value: str) -> dict:
    value=value.strip()
    if not valid_upi(value):
        raise HTTPException(422,'Enter a UPI ID such as name@okaxis, up to 80 characters.')
    await freeze_submitted_upi(db,str(me['_id']))
    await db.users.update_one({'_id':me['_id']},{'$set':{'payment_upi_id':value,'payment_upi_updated_at':datetime.now(timezone.utc)}})
    return await account_upi(db,me)


async def require_account_upi(db, me: dict, legacy: str = '') -> str:
    # Compatibility with older clients: the first valid UPI they explicitly
    # save becomes the account default. Later stale listing values cannot
    # overwrite a newer account-wide address.
    current=await recipient_upi(db,str(me['_id']))
    if current:return current
    if not valid_upi(legacy):
        raise HTTPException(422,'Set your receiving UPI in Settings → How you get paid before offering paid courses or sessions.')
    await freeze_submitted_upi(db,str(me['_id']))
    await db.users.update_one({'_id':me['_id'],'$or':[{'payment_upi_id':{'$exists':False}},{'payment_upi_id':''},{'payment_upi_id':None}]},
        {'$set':{'payment_upi_id':legacy.strip(),'payment_upi_updated_at':datetime.now(timezone.utc)}})
    return await recipient_upi(db,str(me['_id']))
