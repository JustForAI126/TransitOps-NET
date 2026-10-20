# syntax=docker/dockerfile:1
# One image: the React app is built and served from the API's wwwroot, so the UI, REST API and
# SignalR share one origin (no cross-site cookies, and WebSockets work).

FROM node:22-bookworm-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
COPY backend/TransitOps.Domain/TransitOps.Domain.csproj TransitOps.Domain/
COPY backend/TransitOps.Application/TransitOps.Application.csproj TransitOps.Application/
COPY backend/TransitOps.Infrastructure/TransitOps.Infrastructure.csproj TransitOps.Infrastructure/
COPY backend/TransitOps.Api/TransitOps.Api.csproj TransitOps.Api/
RUN dotnet restore TransitOps.Api/TransitOps.Api.csproj
COPY backend/ ./
RUN dotnet publish TransitOps.Api/TransitOps.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=backend /app/publish ./
COPY --from=frontend /src/frontend/dist ./wwwroot
ENV ASPNETCORE_ENVIRONMENT=Production \
    ReverseProxy__TrustAllProxies=true
USER $APP_UID
EXPOSE 8080
# Hosts such as Render pass the port to listen on in $PORT.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} exec dotnet TransitOps.Api.dll"]
