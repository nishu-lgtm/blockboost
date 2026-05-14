import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { classifyIntent } from "@/lib/query-intent";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  websiteUrl: z
    .string()
    .min(1, "Website URL is required")
    .url("Must be a valid URL"),
  brandName: z.string().min(1, "Brand name is required").max(100),
  businessCategory: z.string().max(100).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  prompts: z
    .array(
      z.object({
        text: z.string().min(1),
        category: z.string().min(1),
      })
    )
    .min(3, "At least 3 prompts are required"),
  competitors: z
    .array(
      z.object({
        brandName: z.string().min(1),
        websiteUrl: z.string().url().optional().or(z.literal("")),
      })
    )
    .max(5, "Maximum 5 competitors on Starter plan"),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, websiteUrl, brandName, businessCategory, city, prompts, competitors } = parsed.data;

    // Create project, prompts, and competitors in a single transaction
    const project = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name,
          websiteUrl,
          brandName,
          businessCategory: businessCategory?.trim() || null,
          city: city?.trim() || null,
          userId: session.user!.id!,
        },
      });

      if (prompts.length > 0) {
        await tx.prompt.createMany({
          data: prompts.map((p) => ({
            text: p.text,
            category: p.category,
            intent: classifyIntent(p.text),
            projectId: project.id,
          })),
        });
      }

      const validCompetitors = competitors.filter((c) => c.brandName.trim());
      if (validCompetitors.length > 0) {
        await tx.competitor.createMany({
          data: validCompetitors.map((c) => ({
            brandName: c.brandName.trim(),
            // Store actual URL or null — never a fake placeholder, which would
            // poison citation domain matching downstream.
            websiteUrl: c.websiteUrl?.trim() || null,
            projectId: project.id,
          })),
        });
      }

      return project;
    });

    return NextResponse.json({ projectId: project.id }, { status: 201 });
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json(
      { error: "Failed to create project. Please try again." },
      { status: 500 }
    );
  }
}
