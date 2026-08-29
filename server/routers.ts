import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { accountRouter } from "./routers/account";
import { adminRouter } from "./routers/admin";
import { localAuthRouter } from "./routers/localAuth";
import { exploreRouter } from "./routers/explore";
import { messagesRouter } from "./routers/messages";
import { notificationsRouter } from "./routers/notifications";
import { platformRouter } from "./routers/platform";
import { socialRouter } from "./routers/social";
import { storiesRouter } from "./routers/stories";
import { uploadsRouter } from "./routers/uploads";
import { videosRouter } from "./routers/videos";
import { workspaceRouter } from "./routers/workspace";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    local: localAuthRouter,
  }),
  account: accountRouter,
  platform: platformRouter,
  social: socialRouter,
  uploads: uploadsRouter,
  stories: storiesRouter,
  videos: videosRouter,
  explore: exploreRouter,
  messages: messagesRouter,
  notifications: notificationsRouter,
  admin: adminRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;
