import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { apiReference  } from "@scalar/nestjs-api-reference"
import { VersioningType } from "@nestjs/common"

const bootstrap = async () => {
    const app = await NestFactory.create(AppModule)
    const options = new DocumentBuilder()
        .setTitle("CiYield API")
        .setDescription("CiYield API")
        .setBasePath("/api")
        .build()
    app.setGlobalPrefix("api")
    app.enableVersioning({
        type: VersioningType.URI,
    })
    const document = SwaggerModule.createDocument(app, options)
    app.use("/docs", apiReference({
        content: document,
        customCss: `
          body { font-family: 'JetBrains Mono', monospace; }
        `,
    }))
    await app.listen(process.env.PORT ?? 3001)
}
bootstrap()
