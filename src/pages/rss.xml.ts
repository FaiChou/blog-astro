import { getAllPosts } from "@/data/post";
import { siteConfig } from "@/site.config";
import rss from "@astrojs/rss";
import { collectionDateSort } from "@/utils/date";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { render } from "astro:content";

export const GET = async () => {
	const posts = await getAllPosts();
	const allPostsByDate = posts.sort(collectionDateSort);
	return rss({
		title: siteConfig.title,
		description: siteConfig.description,
		site: import.meta.env.SITE,
		items: await Promise.all(
			allPostsByDate.map(async (post) => {
				const { Content } = await render(post);
				const container = await AstroContainer.create();
				const html = await container.renderToString(Content);
				return {
					title: post.data.title,
					description: post.data.description,
					pubDate: post.data.publishDate,
					link: `posts/${post.id}/`,
					content: html,
				};
			}),
		),
	});
};
