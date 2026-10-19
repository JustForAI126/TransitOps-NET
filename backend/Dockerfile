# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

COPY ["TransitOps.sln", "./"]
COPY ["TransitOps.Domain/TransitOps.Domain.csproj", "TransitOps.Domain/"]
COPY ["TransitOps.Application/TransitOps.Application.csproj", "TransitOps.Application/"]
COPY ["TransitOps.Infrastructure/TransitOps.Infrastructure.csproj", "TransitOps.Infrastructure/"]
COPY ["TransitOps.Api/TransitOps.Api.csproj", "TransitOps.Api/"]

RUN dotnet restore "TransitOps.sln"
COPY . .
WORKDIR "/src/TransitOps.Api"
RUN dotnet publish "TransitOps.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:3000
EXPOSE 3000
ENTRYPOINT ["dotnet", "TransitOps.Api.dll"]
