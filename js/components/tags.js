// Tag data management + tag cloud rendering

let postsData = [];

export function setPostsData(data) {
  postsData = data;
}

export function getAllTags() {
  const tagCounts = {};
  for (const post of postsData) {
    const tags = Array.isArray(post.tags) ? post.tags : [];
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));
}

export function getPostsByTag(tag) {
  return postsData.filter(post => {
    const tags = Array.isArray(post.tags) ? post.tags : [];
    return tags.includes(tag);
  });
}

export function renderTagCloud(tags) {
  return tags.map(({ tag, count }) =>
    `<a href="#/tag/${encodeURIComponent(tag)}" class="tag-chip">${tag}<span class="tag-count">${count}</span></a>`
  ).join('');
}

export function renderTagList(tags) {
  if (!tags || tags.length === 0) return '';
  const arr = Array.isArray(tags) ? tags : [];
  return arr.map(tag =>
    `<a href="#/tag/${encodeURIComponent(tag)}" class="tag-inline">${tag}</a>`
  ).join('');
}
