from fastapi import APIRouter

from mamari_api.modules.agriculture.router import router as agriculture_router
from mamari_api.modules.dashboard.router import router as dashboard_router
from mamari_api.modules.health.router import router as health_router
from mamari_api.modules.identity.router import router as identity_router
from mamari_api.modules.livestock.router import router as livestock_router
from mamari_api.modules.operations.router import router as operations_router
from mamari_api.modules.organizations.router import router as organizations_router
from mamari_api.modules.sales.router import router as sales_router
from mamari_api.modules.stocks.router import router as stocks_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(dashboard_router, tags=["dashboard"])
api_router.include_router(identity_router, tags=["authentication"])
api_router.include_router(organizations_router, tags=["organizations"])
api_router.include_router(agriculture_router, tags=["agriculture"])
api_router.include_router(operations_router, tags=["operations"])
api_router.include_router(livestock_router, tags=["livestock"])
api_router.include_router(sales_router, tags=["sales"])
api_router.include_router(stocks_router, tags=["stocks"])
