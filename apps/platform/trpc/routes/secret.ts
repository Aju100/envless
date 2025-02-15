import { createRouter, withAuth } from "@/trpc/router";
import { Secret } from "@prisma/client";
import { z } from "zod";

export const secrets = createRouter({
  getSecretesByBranchId: withAuth
    .input(
      z.object({
        branchId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { branchId } = input;
      const { user } = ctx.session;

      const branch = await ctx.prisma.branch.findUnique({
        where: {
          id: branchId,
        },

        select: {
          id: true,
          name: true,
          project: {
            select: {
              id: true,
              name: true,
              encryptedProjectKey: {
                select: {
                  encryptedKey: true,
                },
              },
            },
          },
        },
      });

      const secrets = await ctx.prisma.secret.findMany({
        where: {
          branchId,
          userId: user.id,
        },
        select: {
          id: true,
          encryptedKey: true,
          encryptedValue: true,
        },
      });

      return {
        branch,
        secrets,
      };
    }),
  saveSecrets: withAuth
    .input(
      z.object({
        secrets: z.array(
          z.object({
            id: z.string().nullable(),
            encryptedKey: z.string().min(1),
            encryptedValue: z.string().min(1),
            branchId: z.string().min(1),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;
      const { user } = ctx.session;
      const { secrets } = input;

      const secretsToInsert = secrets.map((secret) => {
        if (!secret.id) {
          return {
            encryptedKey: secret.encryptedKey,
            encryptedValue: secret.encryptedValue,
            userId: user.id,
            branchId: secret.branchId,
          };
        }
      });

      const secretsToUpdate = secrets.map((secret) => {
        if (secret.id) {
          return {
            id: secret.id,
            encryptedKey: secret.encryptedKey,
            encryptedValue: secret.encryptedValue,
            branchId: secret.branchId,
          };
        }
      });

      if (secretsToInsert) {
        await prisma.secret.createMany({
          data: secretsToInsert as never,
        });
      }

      if (secretsToUpdate && secretsToUpdate.length > 0) {
        secretsToUpdate.forEach(async (secret) => {
          await prisma.secret.update({
            data: {
              encryptedKey: secret?.encryptedKey,
              encryptedValue: secret?.encryptedValue,
              branchId: secret?.branchId,
            },
            where: {
              id: secret?.id,
            },
          });
        });
      }
    }),
});
