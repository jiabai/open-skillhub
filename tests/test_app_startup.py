from backend.api_app import create_application


def test_create_application_registers_operational_routes():
    application = create_application()
    route_paths = {route.path for route in application.routes if hasattr(route, "path")}

    assert "/livez" in route_paths
    assert "/readyz" in route_paths
    assert "/health" in route_paths
