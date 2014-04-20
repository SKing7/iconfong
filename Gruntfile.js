module.exports = function(grunt){
    grunt.loadTasks('task');

    // 默认任务
    grunt.registerTask('default', ['build']);
}
