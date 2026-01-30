import { getCollection, render } from "astro:content";
import { siteConfig } from "@/site.config";
import rss from "@astrojs/rss";
import { experimental_AstroContainer as AstroContainer } from "astro/container";

export const GET = async () => {
	const notes = await getCollection("note");

	return rss({
		title: siteConfig.title,
		description: siteConfig.description,
		site: import.meta.env.SITE,
		items: await Promise.all(
			notes.map(async (note) => {
				const { Content } = await render(note);
				const container = await AstroContainer.create();
				const html = await container.renderToString(Content);
				return {
					title: note.data.title,
					pubDate: note.data.publishDate,
					link: `notes/${note.id}/`,
					content: html,
				};
			}),
		),
	});
};
