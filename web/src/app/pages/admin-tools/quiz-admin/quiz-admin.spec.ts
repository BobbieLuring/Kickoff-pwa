import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuizAdmin } from './quiz-admin';

describe('QuizAdmin', () => {
  let component: QuizAdmin;
  let fixture: ComponentFixture<QuizAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizAdmin],
    }).compileComponents();

    fixture = TestBed.createComponent(QuizAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
