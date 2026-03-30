import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";
import type { TaskImageRecord } from "../../../shared/src/types.js";
import { AppError } from "../utils/errors.js";

type ImgbbResponse = {
  success?: boolean;
  status?: number;
  error?: {
    message?: string;
  };
  data?: {
    url?: string;
    display_url?: string;
    delete_url?: string;
    image?: {
      filename?: string;
    };
  };
};

export class ImageHostingService {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger
  ) {}

  async uploadBase64Image(imageData: string, name?: string): Promise<TaskImageRecord> {
    const cleaned = imageData.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").trim();
    if (!cleaned) {
      throw new AppError(400, "invalid_image", "Image payload is empty.");
    }

    return this.upload({
      image: cleaned,
      name
    });
  }

  async uploadImageUrl(url: string, name?: string): Promise<TaskImageRecord> {
    return this.upload({
      image: url,
      name
    });
  }

  private async upload(input: { image: string; name?: string }) {
    const body = new FormData();
    body.set("image", input.image);
    if (input.name) {
      body.set("name", input.name);
    }

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(this.config.media.imgbbApiKey)}`, {
      method: "POST",
      body
    });

    const payload = (await response.json().catch(() => ({}))) as ImgbbResponse;
    if (!response.ok || !payload.success || !payload.data?.url || !payload.data.display_url) {
      this.logger.error({ status: response.status, payload }, "imgbb_upload_failed");
      throw new AppError(502, "image_upload_failed", payload.error?.message ?? "Image hosting upload failed.");
    }

    return {
      url: payload.data.url,
      displayUrl: payload.data.display_url,
      deleteUrl: payload.data.delete_url ?? null,
      filename: payload.data.image?.filename ?? input.name ?? null
    };
  }
}
