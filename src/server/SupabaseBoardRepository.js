'use strict';

const { createClient } = require('@supabase/supabase-js');
const BaseRepository = require('./BaseRepository');
const { LEVEL_NAME_MAP } = require('./BoardRepositoryAccess');
const { resolveBoardDefinitions } = require('./BoardDefinitionResolver');
const readOps = require('./SupabaseBoardRepositoryReadOps');
const writeOps = require('./SupabaseBoardRepositoryWriteOps');

class SupabaseBoardRepository extends BaseRepository {
  constructor(options) {
    super({ ...options, driverName: 'supabase' });
    this.levelAliases = { ...LEVEL_NAME_MAP, ...(options.levelAliases || {}) };
    this.tables = {
      boards: options.boardsTable || 'boards',
      posts: options.postsTable || 'posts',
      recommendations: options.recommendationsTable || 'post_recommendations'
    };
    this.columns = {
      family: options.familyColumn || 'family_id',
      orderby: options.orderColumn || 'sort_order',
      step: options.stepColumn || 'depth'
    };
    this.boards = resolveBoardDefinitions(options.menuFilePath).map((board, index) => ({
      id: index + 1,
      ...board
    }));
    this.client = createClient(options.url, options.serviceRoleKey, {
      auth: { persistSession: false }
    });
  }

  getMeta() {
    return {
      ...super.getMeta(),
      tables: this.tables
    };
  }

  async listBoards() { return readOps.listBoards(this); }
  async getBoard(boardId) { return readOps.getBoard(this, boardId); }
  async countPosts() { return readOps.countPosts(this); }
  async countPostsSince(since) { return readOps.countPostsSince(this, since); }
  async listHotPosts(options = {}) { return readOps.listHotPosts(this, options); }
  async listPosts(boardId, options = {}) { return readOps.listPosts(this, boardId, options); }
  async getPost(boardId, postId, options = {}) { return readOps.getPost(this, boardId, postId, options); }
  async createPost(boardId, input, context = {}) { return writeOps.createPost(this, boardId, input, context); }
  async replyToPost(boardId, parentPostId, input, context = {}) { return writeOps.replyToPost(this, boardId, parentPostId, input, context); }
  async updatePost(boardId, postId, input, context = {}) { return writeOps.updatePost(this, boardId, postId, input, context); }
  async deletePost(boardId, postId, context = {}) { return writeOps.deletePost(this, boardId, postId, context); }
  async recommendPost(boardId, postId, context = {}) { return writeOps.recommendPost(this, boardId, postId, context); }
}

module.exports = {
  SupabaseBoardRepository
};
