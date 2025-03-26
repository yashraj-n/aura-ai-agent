import { reviews, reviewStatus } from "../db/schema/review";
import { db } from "../db/index";
import { eq } from "drizzle-orm";

export default class ReviewManager {
    private reviewDetails: typeof reviews.$inferInsert;
    constructor(reviewDetails: typeof reviews.$inferInsert) {
        this.reviewDetails = reviewDetails;
    }

    async createReview() {
        return await db.insert(reviews).values(this.reviewDetails);
    }

    async setReviewStatus(status: reviewStatus) {
        return await db
            .update(reviews)
            .set({ status })
            .where(eq(reviews.id, this.reviewDetails.id));
    }

    async setReviewEndedAt() {
        return await db
            .update(reviews)
            .set({ endedAt: new Date() })
            .where(eq(reviews.id, this.reviewDetails.id));
    }

    async setReviewReview(review: string) {
        return await db
            .update(reviews)
            .set({ review })
            .where(eq(reviews.id, this.reviewDetails.id));
    }
}
