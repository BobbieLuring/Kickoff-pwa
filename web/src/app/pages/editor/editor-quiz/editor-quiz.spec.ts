import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditorQuiz } from './editor-quiz';

describe('EditorQuiz', () => {
  let component: EditorQuiz;
  let fixture: ComponentFixture<EditorQuiz>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorQuiz],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorQuiz);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
