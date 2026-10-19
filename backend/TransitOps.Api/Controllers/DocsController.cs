using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace TransitOps.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DocsController : ControllerBase
{
    private readonly IWebHostEnvironment _env;

    public DocsController(IWebHostEnvironment env)
    {
        _env = env;
    }

    [HttpGet("postman")]
    public IActionResult GetPostmanCollection()
    {
        var filePath = Path.Combine(_env.ContentRootPath, "postman_collection.json");
        if (!System.IO.File.Exists(filePath))
        {
            // If running from root directory, check parent or relative
            filePath = Path.Combine(Directory.GetCurrentDirectory(), "postman_collection.json");
        }

        if (System.IO.File.Exists(filePath))
        {
            var bytes = System.IO.File.ReadAllBytes(filePath);
            return File(bytes, "application/json", "TransitOps.postman_collection.json");
        }

        return NotFound(new { message = "Postman collection file not found." });
    }
}
