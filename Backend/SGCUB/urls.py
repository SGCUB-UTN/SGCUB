"""
URL configuration for SGCUB project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
    
from django.conf.urls import include
from django.contrib import admin
from django.urls import path
from django.views.generic import RedirectView
from . import settings
from usuarios.urls import auth_urlpatterns, usuario_urlpatterns
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api-auth/", include("rest_framework.urls")),
    path("api/auth/", include(auth_urlpatterns)),
    path("api/usuarios/", include(usuario_urlpatterns)),
    path("api/padron/", include("padron.urls")),   
    path("api/finanzas/", include("finanzas.urls")),
    path("api/documental/", include("documental.urls")),
    path("api/comunicaciones/", include("comunicaciones.urls")),
    path("api/comet/", include("comet.urls")),
     ]
if settings.DEBUG:
    urlpatterns += [
          # Swagger / OpenAPI URLs
             path('',RedirectView.as_view(url='/api/docs/', permanent=False), name='index'),
             path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
             path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
              path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    ]

from django.conf.urls.static import static
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
